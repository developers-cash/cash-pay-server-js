const axios = require('axios')

const BitcoinCashJS = require('bitcoincashjs-lib')
const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()

/**
  * (NOT AVAILABLE WHEN INCLUDED FROM CDN)
  *
  * This class contains useful utilities for verifying CashPayServer Webhook signatures.
  * @example
  * // Create instance
  * let webhook = new CashPayServer.Webhook()
  * await webhook.addTrust('https://pay.infra.cash')
  *
  * // Validate Webhook when it is received
  * webhook.verifySignature(payload, httpHeaders)
  */
class Webhook {
  constructor (options) {
    this._keys = {}
  }

  /**
   * Add a Cash Pay Server to trusted servers list.
   *
   * This will automatically update the Public Keys when they have expired.
   * @param {string} endpoint Endpoint of the Cash Pay Server
   * @example
   * // Add 'pay.infra.cash' and 'dev.pay.infra.cash'
   * webhook.addTrusted('https://pay.infra.cash')
   * webhook.addTrusted('https://dev.pay.infra.cash')
   */
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
   * Verifies the signature of a Webhook Payload
   *
   * @param {(string|object)} payload String or Object containing the payload
   * @param {object} headers HTTP Headers (requires digest, x-identity, x-signature-type and x-signature)
   * @example
   * // ExpressJS
   * webhook.verifySignature(req.body, req.headers)
   */
  async verifySignature (payload, headers) {
    let digest = headers.digest
    const identity = headers['x-identity']
    let signature = headers['x-signature']
    const signatureType = headers['x-signature-type']

    // Make sure signature type is ECC
    if (signatureType !== 'ECC') {
      throw new Error(`x-signature-type must be ECC (current value ${signatureType})`)
    }

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
