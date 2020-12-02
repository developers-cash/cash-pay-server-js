const axios = require('axios')

const config = require('./config')

const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()

/**
  * This class contains useful utilities for verifying Websocket and Webhook Events.
  * @example
  * // Verify signatures for Webhook Event
  * CashPay.Signatures.verifyWebhook(req.body, req.headers)
  *
  * // Verify signatures for Websocket Event
  * CashPay.Signatures.verifyEvent(payload)
  */
class Signatures {
  /**
   * <p>Refreshes the keys using the endpoint given at CashPay.config.options.endpoint.</p>
   * <p>This will be called automatically, as needed, by verifyWebhook and verifyEvent.</p>
   * <p>You should not need to call this manually.</p>
   * @example
   * CashPay.Signatures.refreshKeys()
   */
  static async refreshKeys () {
    const res = await axios.get(`${config.options.endpoint}/signingKeys/paymentProtocol.json`)
    this._keys = {
      endpoint: config.options.endpoint,
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
   * CashPay.Signatures.verifyWebhook(req.body, req.headers)
   */
  static async verifyWebhook (payload, headers) {
    const signature = {
      digest: headers.digest,
      identity: headers.identity,
      signature: headers.signature,
      signatureType: headers.signatureType
    }

    return this._verify(payload, signature)
  }

  /**
   * Verifies the signature of a Webhook Payload
   *
   * @param {(string|object)} payload String or Object containing the Websocket Event payload
   * @example
   * CashPay.Signatures.verifyEvent(payload)
   */
  static async verifyEvent (payload) {
    const signature = {
      digest: payload.signature.digest,
      identity: payload.signature.identity,
      signature: payload.signature.signature,
      signatureType: payload.signature.signatureType
    }

    delete payload.signature

    return this._verify(payload, signature)
  }

  static async _verify (payload, signature) {
    // Make sure signature type is ECC
    if (signature.signatureType !== 'ECC') {
      throw new Error(`x-signature-type must be ECC (current value ${signature.signatureType})`)
    }

    // Refresh keys if they don't exist or are expired
    if (!this._keys || new Date() > new Date(this._keys.expirationDate)) {
      await this.refreshKeys()
    }

    // Convert into buffers
    if (typeof payload === 'object') {
      payload = JSON.stringify(payload)
    }

    if (typeof payload === 'string') {
      payload = Buffer.from(payload)
    }

    if (typeof signature.digest === 'string') {
      signature.digest = Buffer.from(signature.digest, 'base64')
    }

    if (typeof signature.signature === 'string') {
      signature.signature = Buffer.from(signature.signature, 'base64')
    }

    // Compare the digest (SHA256 of payload)
    const payloadDigest = libCash.Crypto.sha256(payload)

    if (Buffer.compare(payloadDigest, signature.digest)) {
      throw new Error('Payload digest did not match header digest')
    }

    const correct = this._keys.publicKeys.reduce((isValid, publicKey) => {
      const ecPair = libCash.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'))
      const result = isValid += libCash.ECPair.verify(
        ecPair,
        payloadDigest,
        signature.signature
      )
      return result
    }, false)

    if (!correct) {
      throw new Error('Signature verification failed')
    }

    return true
  }
}

Signatures._keys = null

module.exports = Signatures
