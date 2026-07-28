package com.arynoxtech.erp.service

import android.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

object BarcodeCrypto {
    private const val SECRET_KEY = "AdityaERP!@#$%^&"
    private const val ALGORITHM = "AES/ECB/PKCS5Padding"
    private const val PREFIX = "AE:"
    private const val CIPHER = "AES"

    fun encrypt(data: String): String {
        return try {
            val keySpec = SecretKeySpec(SECRET_KEY.toByteArray(Charsets.UTF_8), CIPHER)
            val cipher = Cipher.getInstance(ALGORITHM)
            cipher.init(Cipher.ENCRYPT_MODE, keySpec)
            val encrypted = cipher.doFinal(data.toByteArray(Charsets.UTF_8))
            "$PREFIX${Base64.encodeToString(encrypted, Base64.NO_WRAP)}"
        } catch (e: Exception) {
            "$PREFIX$data"
        }
    }

    fun decrypt(encoded: String): String? {
        return try {
            if (!encoded.startsWith(PREFIX)) return null
            val raw = encoded.removePrefix(PREFIX)
            val keySpec = SecretKeySpec(SECRET_KEY.toByteArray(Charsets.UTF_8), CIPHER)
            val cipher = Cipher.getInstance(ALGORITHM)
            cipher.init(Cipher.DECRYPT_MODE, keySpec)
            val decrypted = cipher.doFinal(Base64.decode(raw, Base64.NO_WRAP))
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            null
        }
    }

    fun isPrivateBarcode(barcode: String): Boolean {
        return barcode.startsWith(PREFIX)
    }
}
