/**
 * Global Config used by Cash Pay Server
 * 
 * These are usually default values that will be used when an invoice is created.
 * 
 * @example
 * // Use a self-hosted server
 * CashPay.config.options.endpoint = 'https://cash-pay.self-hoster.com'
 * 
 * // Show/calculate totals in Australian dollars
 * CashPay.config.invoice.userCurrency = 'AUD'
 *
 * // Newly created invoices will use the globals given above
 * let invoice == CashPay.Invoice(...)
 */
class Config {
  constructor() {
    /**
     * Instance options for Invoice
     * 
     * Default values and valid properties are shown below in the example.
     * @example
     * {
     *   endpoint: 'https://pay.infra.cash',
     *   listen: typeof window !== 'undefined' // false if not in browser
     * }
     */
    this.options = {
      endpoint: 'https://pay.infra.cash',
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
     *   behavior: 'normal',
     *   network: 'main'
     *   userCurrency: 'USD'
     * }
     */
    this.invoice = {
      behavior: 'normal',
      network: 'main',
      outputs: [],
      userCurrency: 'USD',
      webhooks: {},
      static: {}
    }
  }
}

module.exports = new Config
