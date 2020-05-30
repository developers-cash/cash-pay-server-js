const invoice = {
  options: {
    behavior: 'normal',
    network: 'main',
    outputs: [],
    userCurrency: 'USD',
    webhooks: {}
  }
}

const options = {
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

module.exports = {
  invoice: invoice,
  options: options
}
