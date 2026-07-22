/**
 * Cifrado extremo a extremo (E2E) — AES-GCM 256-bit + PBKDF2 SHA-256
 * La frase de cifrado NUNCA sale del dispositivo.
 * El servidor solo almacena { ciphertext, salt, iv, version, _lastModified }.
 */
const CryptoE2E = {
  _ITERATIONS: 250_000,
  _KEY_BITS: 256,
  _SALT_LEN: 16,
  _IV_LEN: 12,

  /** Deriva una clave AES-GCM desde la frase + salt aleatorio */
  async _deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: this._ITERATIONS },
      keyMaterial,
      { name: 'AES-GCM', length: this._KEY_BITS },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /** Convierte Uint8Array → base64 */
  _b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  },

  /** Convierte base64 → Uint8Array */
  _fromb64(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  },

  /**
   * Cifra plaintext (string JSON) con passphrase.
   * Devuelve { ciphertext, salt, iv, version } — todo en base64.
   */
  async encrypt(plaintext, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(this._SALT_LEN));
    const iv   = crypto.getRandomValues(new Uint8Array(this._IV_LEN));
    const key  = await this._deriveKey(passphrase, salt);
    const enc  = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );
    return {
      ciphertext: this._b64(cipherBuf),
      salt: this._b64(salt),
      iv:   this._b64(iv),
      version: 1,
    };
  },

  /**
   * Descifra un payload { ciphertext, salt, iv } con passphrase.
   * Lanza error si la frase es incorrecta o los datos están corruptos.
   */
  async decrypt(payload, passphrase) {
    try {
      const salt = this._fromb64(payload.salt);
      const iv   = this._fromb64(payload.iv);
      const ct   = this._fromb64(payload.ciphertext);
      const key  = await this._deriveKey(passphrase, salt);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ct
      );
      return new TextDecoder().decode(plainBuf);
    } catch {
      throw new Error('Frase de cifrado incorrecta o datos corruptos');
    }
  },

  /** Verifica si Web Crypto está disponible en este contexto */
  isAvailable() {
    return typeof crypto !== 'undefined' && !!crypto.subtle;
  },
};
