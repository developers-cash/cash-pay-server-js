/**
 * Global Config used by Cash Pay Server
 *
 * These are default values that will be used when an invoice is created.
 *
 * @example
 * // Use a self-hosted server
 * CashPay.config.options.endpoint = 'https://cash-pay.self-hosted.com'
 *
 * // Show totals in Australian dollars
 * CashPay.config.invoice.userCurrency = 'AUD'
 *
 * // Newly created invoices will use the globals given above
 * let invoice == CashPay.Invoice(...)
 */
class Config {
  constructor () {
    /**
     * Instance options for Invoice
     *
     * Default values and valid properties are shown below in the example.
     * @example
     * {
     *   endpoint: 'https://v1.pay.infra.cash',
     *   listen: typeof window !== 'undefined' // false if not in browser
     * }
     */
    this.options = {
      endpoint: 'https://v1.pay.infra.cash',
      listen: typeof window !== 'undefined',
      on: {
        created: [],
        connected: [],
        subscribed: [],
        requested: [],
        broadcasting: [],
        broadcasted: [],
        expired: [],
        timer: [],
        failed: []
      }
    }

    /**
     * Default Invoice Properties
     *
     * Default values and valid properties are shown below in the example
     * @example
     * {
     *   network: 'main'
     *   outputs: [],
     *   userCurrency: 'USD',
     *   webhook: {}
     * }
     */
    this.invoice = {
      chain: 'BCH',
      network: 'main',
      currency: 'BCH',
      outputs: [],
      userCurrency: 'USD',
      webhook: {}
    }
  }
}

module.exports = new Config()
