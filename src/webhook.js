const axios = require('axios')

const BitcoinCashJS = require('bitcoincashjs-lib')
const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()

/**
  * Webhook class
  */
class Webhook {
  constructor (options) {
    this._keys = {}
  }

  async addTrusted (endpoint) {
    try {
      const res = await axios.get(`${endpoint}/signingKeys/paymentProtocol.json`)
      this._keys[res.data.owner] = {
        endpoint: endpoint,
        expirationDate: res.data.expirationDate,
        publicKeys: res.data.publicKeys
      }
    } catch (err) {
      console.error(err)
    }

    return this
  }

  /**
   * Verifies a Webhook Payload
   */
  async verifyPayload (payload, headers) {
    const identity = headers['x-identity']
    const trusted = this._keys[identity]

    // Convert into buffers
    if (typeof headers.digest === 'string') {
      headers.digest = Buffer.from(headers.digest, 'base64')
    }

    if (typeof headers['x-signature'] === 'string') {
      headers['x-signature'] = Buffer.from(headers['x-signature'], 'base64')
    }

    // Refresh trusted if past expiration
    if (new Date() > new Date(trusted.expirationDate)) {
      await this.addTrusted(trusted.endpoint)
    }

    // Compare the digest (SHA256 of payload)
    const payloadDigest = Buffer.from(libCash.Crypto.sha256(payload), 'utf8')
    if (Buffer.compare(payloadDigest, headers.digest)) {
      throw new Error('Payload digest did not match header digest')
    }

    const correct = this._keys[identity].publicKeys.reduce((isValid, publicKey) => {
      const ecPair = libCash.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'))
      const result = isValid += libCash.ECPair.verify(
        ecPair,
        headers.digest,
        BitcoinCashJS.ECSignature.fromDER(headers['x-signature']) // TODO Workout how to avoid calling this directly
      )
      return result
    }, false)

    return correct
  }
}

module.exports = Webhook
