const config = require('./config')

const _ = require('lodash')
const axios = require('axios')
const SocketIO = require('socket.io-client')
const QRCode = require('qrcode')

const template = require('../statics/template.html')
const loading = require('../statics/loading.svg')
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
  * @property {String} id - ID of the invoice
  *
  * @param {object} opts Options for invoice instance (use setters instead)
  * @param {object} invoice Invoice properties (use setters instead)
  * @example
  * //
  * // Server-side
  * //
  * let invoice = new CashPay.Invoice()
  *   .setAPIKey('your.site|SECURE_KEY_123')
  *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
  *   .setWebhook('https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2'. ['confirmed'])
  * await invoice.create()
  *
  * // Send Payload JSON to browser
  * return invoice.payload()
  *
  * //
  * // Client-side
  * //
  * let invoice = new CashPay.Invoice()
  *   .intoContainer(document.getElementById('invoice-container'))
  *   .on(['broadcasting', 'broadcasted'], (event) {
  *     console.log(event)
  *   })
  * await invoice.createFrom('https://your-endpoint-above', {
  *   items: ['ITEM-001', 'ITEM_002']
  * })
  */
class Invoice {
  constructor (opts = {}, invoice = {}) {
    this._instance = {}

    Object.assign(this, _.cloneDeep(config.invoice), invoice)
    Object.assign(this._instance, _.cloneDeep(config.options), opts)
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
   *   .on('failed', err => {
   *     alert(err.message)
   *   }
   *
   * // Add event listener for broadcasting and broadcasted event
   * let invoice = new CashPay.Invoice()
   *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1AAAA')
   *   .on(['broadcasting', 'broadcasted'], e => {
   *     console.log(e)
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
   * @param {string} script Raw output script (in ASM)
   * @param {number} [amount=0] Amount in satoshis
   * @example
   * // Set OP_RETURN data to "TEST_OP_RETURN"
   * invoice.addOutput('OP_RETURN 544553545f4f505f52455455524e')
   * invoice.addOutput(`OP_RETURN ${Buffer.from('TEST_OP_RETURN').toString('hex')}`)
   */
  addOutput (script, amount = 0) {
    this.outputs.push({
      script: script,
      amount: amount
    })

    return this
  }

  /**
   * Set network
   * @param {string} network Network to use
   * @example
   * // Use testnet
   * invoice.setNetwork('test')
   */
  setNetwork (network) {
    this.network = network
    return this
  }

  /**
   * Set expiration time
   * @param {number} seconds Seconds from time of creation that Payment Request expires
   * @example
   * // 15 minutes
   * invoice.setExpires(15 * 60)
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
   * Sets a BIP70/JPP memo to show AFTER payment
   * @param {string} memoPaid Memo text
   * @example
   * // Memos are not supported by all wallets
   * invoice.setMemoPaid('Thank you for your payment')
   */
  setMemoPaid (memoPaid) {
    this.memoPaid = memoPaid
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
   * <p>This field will not be included in WebSocket events and omitted in the payload() function.</p>
   * <p><small>This should never be used if the invoice is created client-side (in the browser).</small></p>
   * @example
   * invoice.setAPIKey('https://t.me/yourname|SECURE_STRING')
   */
  setAPIKey (key) {
    this.apiKey = key
    return this
  }

  /**
   * <p>Sets (Public) Data against the invoice.</p>
   * @param {(string|object)} data If an object is passed, this will be converted to a string.
   * @example
   * // Using a string
   * invoice.setData("https://your-site.com/some-url-to-redirect-to");
   *
   * // Using an object
   * invoice.setData({
   *  redirectURL: 'https://your-site.com/some-url-to-redirect-to'
   * })
   */
  setData (data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data)
    }

    this.data = data
    return this
  }

  /**
   * <p>Sets Private Data against the invoice.</p>
   * <p>This field will not be included in WebSocket events and omitted in the payload() function.</p>
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
   * let invoice = new CashPay.Invoice();
   *   .setWebhook('https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2');
   *
   * // Only trigger on "broadcasting" and "broadcasted"
   * let invoice = new CashPay.Invoice();
   *   .setWebhook('https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2', ['broadcasting', 'broadcasted'])
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
   * <p>Browser Environment: Websocket and Expiry timers WILL be instantiated.</p>
   * <p>NodeJS Enviroment: Websocket and Expiry timers WILL NOT be instantiated.</p>
   * @example
   * let invoice = new CashPay.Invoice()
   *   .intoContainer(document.getElementById('invoice-container'))
   *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
   *   .on('broadcasted', e => {
   *     console.log(e)
   *   })
   * await invoice.create()
   */
  async create () {
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
          this.destroy()
        })

        await this._listen()
      }

      this._instance.on.created.forEach(cb => cb())

      return this
    } catch (err) {
      this._instance.on.failed.forEach(cb => cb(err))
      throw err
    }
  }

  /**
   * <p>Load a created invoice from a server-side endpoint.</p>
   * @param {String} endpoint The endpoint to use
   * @param {Object} [params] POST parameters to send to endpoint
   * @param {Object} [option] Options to pass to axios.post
   * @example
   * // Using default container
   * const invoice = new CashPay.Invoice()
   *   .intoContainer(document.getElementById('invoice-container'))
   *   .on('broadcasted', e => {
   *     console.log(e)
   *   })
   * await invoice.createFrom('https://api.your-site.com/request-invoice', {
   *   items: ['ITEM_001', 'ITEM_002']
   * })
   */
  async createFrom (endpoint, params = {}, options = {}) {
    try {
      const res = await axios.post(endpoint, params, options)
      Object.assign(this, res.data)
      await this.create()
    } catch (err) {
      this._instance.on.failed.forEach(cb => cb(err))
      throw err
    }
  }

  /**
   * <p>Instantiate the invoice from an existing invoice.</p>
   * <p>Similar to createFrom, but where you handle the AJAX request.</p>
   * @param {Object} [params] POST parameters to send to endpoint
   * @example
   * const res = axios.post('https://api.your-site.com/request-invoice', {
   *   items: ['ITEM_001', 'ITEM_002']
   * })
   *
   * let invoice = new CashPay.Invoice()
   *   .intoContainer(document.getElementById('invoice-container'))
   *   .on('broadcasted', e => {
   *     console.log(e)
   *   })
   * await invoice.createFromExisting(res.data.invoice)
   */
  async createFromExisting (invoice) {
    try {
      Object.assign(this, invoice)
      await this.create()
    } catch (err) {
      this._instance.on.failed.forEach(cb => cb(err))
      throw err
    }
  }

  /**
   * <p>Get the payload of the invoice.</p>
   * <p>This function can be used to pass the invoice back to the browser from the server-side.</p>
   * <p><small>The fields [apiKey, privateData, webhook, events] will be omitted from the payload</small></p>
   * @example
   * // Get JSON payload
   * let payload = invoice.payload()
   */
  payload () {
    return _.omit(this, '_instance', 'apiKey', 'privateData', 'webhook', 'events')
  }

  /**
   * <p>Destroy the invoice instance.</p>
   * <p>This function should be used to clear all listeners from the invoice.</p>
   * <p>You will need to call this manually if you are not using the OOTB intoContainer function.</p>
   * <p><small>Note this does not destroy the container itself, but the timers/websocket listener.</small></p>
   * @example
   * // Destroy the invoice to prevent memory-leaks/dangling references
   * invoice.destroy()
   */
  async destroy () {
    this._instance.socket.disconnect()
    clearInterval(this._instance.expiryTimer)
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
    const timerFunc = () => {
      const expires = new Date(this.expires * 1000).getTime()
      const now = new Date().getTime()
      const secondsRemaining = Math.round((expires - now) / 1000)

      if (secondsRemaining) {
        this._instance.on.timer.forEach(cb => cb(secondsRemaining))
      } else {
        this._instance.on.expired.forEach(cb => cb())
      }
    }

    this._instance.expiryTimer = setInterval(timerFunc, 1000)
    timerFunc()
  }

  /**
   * <p>Load the invoice into a DOM container.</p>
   * <p>If the DOM element is empty, default template will be used.</p>
   * <p>Note: If container is removed from DOM, invoice listeners will be destroyed by default. See destroyOnRemoved param in options.</p>
   * @param {DOMElement} container Container to load into
   * @param {String} options.lang.expiresIn Text to use for Expires In
   * @param {String} options.lang.invoiceHasExpired Text to use when Invoice has expired
   * @param {Boolean} [options.destroyOnRemoved=true] Destroy invoice listeners when DOM element removed
   * @example
   * // No options
   * const invoice = new CashPay.Invoice()
   *   .intoContainer(document.getElementById('invoice-container')
   *
   * // Change Invoice Expired Text for Captcha
   * const invoice = new CashPay.Invoice()
   *   .intoContainer(document.getElementById('invoice-container', {
   *     lang: {
   *       invoiceHasExpired: 'Captcha has expired'
   *     }
   *   })
   */
  intoContainer (container, options) {
    options = Object.assign({
      template: template,
      lang: {
        expiresIn: 'Expires in ',
        invoiceHasExpired: 'Invoice has expired'
      },
      destroyOnRemoved: true
    }, options)

    // Inject template (otherwise, assume it's already there)
    if (options.template && container.innerHTML.trim() === '') {
      container.innerHTML = options.template
    }

    // Find container elements
    const subContainerEl = container.querySelector('.cashpay-container')
    const LinkEl = container.querySelector('.cashpay-link')
    const svgContainerEl = container.querySelector('.cashpay-svg-container')
    const totalNativeEl = container.querySelector('.cashpay-total-native')
    const totalFiatEl = container.querySelector('.cashpay-total-fiat')
    const expiresEl = container.querySelector('.cashpay-expires')
    const errorEl = container.querySelector('.cashpay-error')

    // Set loading SVG
    if (subContainerEl) subContainerEl.classList.add('loading')
    if (svgContainerEl) svgContainerEl.innerHTML = loading

    // Trigger on invoice creation...
    this.on('created', async () => {
      // Remove loading class
      if (subContainerEl) subContainerEl.classList.remove('loading')

      // Render QR Code
      if (svgContainerEl) {
        svgContainerEl.classList.add('cashpay-animation-zoom-in')
        svgContainerEl.innerHTML = await QRCode.toString(this.service.walletURI, {
          type: 'svg',
          margin: 0
        })
      }

      // Set link on QR Code
      if (LinkEl) LinkEl.href = this.service.walletURI

      // Set totals for BCH and Fiat
      if (totalFiatEl) totalFiatEl.innerText = `${this.totals.userCurrencyTotal}${this.userCurrency}`

      // Show value in BCH
      if (totalNativeEl) totalNativeEl.innerText = `${this.totals.nativeTotal / 100000000}${this.currency}`

      // Show the subcontainer
      if (subContainerEl) subContainerEl.style.display = 'block'
    })

    // Trigger on invoice broadcasted...
    this.on('broadcasted', () => {
      if (subContainerEl) subContainerEl.classList.add('broadcasted')
      if (svgContainerEl) svgContainerEl.innerHTML = tick
      if (svgContainerEl) svgContainerEl.classList.remove('cashpay-animation-zoom-in')
      if (svgContainerEl) svgContainerEl.classList.add('cashpay-animation-pulse')
      if (LinkEl) LinkEl.removeAttribute('href')
      if (expiresEl) expiresEl.innerText = ''
    })

    // Trigger on invoice expiry
    this.on('expired', () => {
      if (subContainerEl) subContainerEl.classList.add('expired')
      if (svgContainerEl) svgContainerEl.innerHTML = cross
      if (svgContainerEl) svgContainerEl.classList.remove('cashpay-animation-zoom-in')
      if (svgContainerEl) svgContainerEl.classList.add('cashpay-animation-pulse')
      if (LinkEl) LinkEl.removeAttribute('href')
      if (expiresEl) expiresEl.innerText = options.lang.invoiceHasExpired
    })

    // Trigger each time expiration timer updates
    this.on('timer', (secondsRemaining) => {
      const minutes = Math.floor(secondsRemaining / 60)
      const seconds = secondsRemaining % 60
      if (expiresEl) expiresEl.innerText = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`
    })

    // Trigger on failed
    this.on('failed', (err) => {
      if (errorEl) errorEl.innerText = err.message
    })

    // If DOM element is removed, call destroy
    if (options.destroyOnRemoved) {
      const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(container)) {
          observer.disconnect()
          this.destroy()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return this
  }
}

module.exports = Invoice
