const _ = require('lodash')
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
    const res = await axios.get(`${endpoint}/signingKeys/paymentProtocol.json`)
    this._keys[res.data.owner] = {
      endpoint: endpoint,
      expirationDate: res.data.expirationDate,
      publicKeys: res.data.publicKeys
    }

    return this
  }

  /**
   * Verifies a Webhook Payload
   */
  async verifySignature (payload, headers) {
    let digest = headers['digest']
    let identity = headers['x-identity']
    let signature = headers['x-signature']
    let signatureType = headers['x-signature-type']
    
    const trusted = this._keys[identity]

    // Convert into buffers
    if (typeof payload === 'object') {
      payload = JSON.stringify(payload)
    }
    
    if (typeof payload === 'string') {
      payload = Buffer.from(payload)
    }

    if (typeof digest === 'string') {
      digest = Buffer.from(digest, 'base64')
    }

    if (typeof signature === 'string') {
      signature = Buffer.from(signature, 'base64')
    }

    // Refresh trusted if past expiration
    if (new Date() > new Date(trusted.expirationDate)) {
      await this.addTrusted(trusted.endpoint)
    }

    // Compare the digest (SHA256 of payload)
    const payloadDigest = libCash.Crypto.sha256(payload)

    if (Buffer.compare(payloadDigest, digest)) {
      throw new Error('Payload digest did not match header digest')
    }
    
    const correct = this._keys[identity].publicKeys.reduce((isValid, publicKey) => {
      const ecPair = libCash.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'))
      const result = isValid += libCash.ECPair.verify(
        ecPair,
        digest,
        BitcoinCashJS.ECSignature.fromDER(signature) // TODO Workout how to avoid calling this directly
      )
      return result
    }, false)

    if (!correct) {
      throw new Error(`Signature verification failed (using ${trusted})`)
    }
  }
}

module.exports = Webhook
