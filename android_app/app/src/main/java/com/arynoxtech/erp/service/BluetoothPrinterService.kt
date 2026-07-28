package com.arynoxtech.erp.service

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.annotation.RequiresPermission
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

data class BluetoothDeviceInfo(
    val name: String,
    val address: String,
    val type: String
)

data class ReceiptLine(
    val text: String,
    val isBold: Boolean = false,
    val isDoubleWidth: Boolean = false,
    val align: Int = 0
)

@Singleton
class BluetoothPrinterService @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private var bluetoothSocket: BluetoothSocket? = null
    private var usbDeviceConnection: UsbDeviceConnection? = null
    private var usbOutputStream: OutputStream? = null
    private var usbInputStream: InputStream? = null
    private var connectedDevice: BluetoothDeviceInfo? = null
    private val connectedDevices = mutableListOf<BluetoothDeviceInfo>()

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        manager.adapter
    }

    private val usbManager: UsbManager by lazy {
        context.getSystemService(Context.USB_SERVICE) as UsbManager
    }

    companion object {
        private const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"
        private const val USB_TIMEOUT_MS = 2000

        private val ESC = byteArrayOf(0x1B)
        private val GS = byteArrayOf(0x1D)

        fun initPrinter(): ByteArray = byteArrayOf(0x1B, 0x40)
        fun cutPaper(): ByteArray = byteArrayOf(0x1D, 0x56, 0x00)
        fun feedPaper(lines: Int): ByteArray = byteArrayOf(0x1B, 0x64, lines.toByte())
        fun boldOn(): ByteArray = byteArrayOf(0x1B, 0x45, 0x01)
        fun boldOff(): ByteArray = byteArrayOf(0x1B, 0x45, 0x00)
        fun alignLeft(): ByteArray = byteArrayOf(0x1B, 0x61, 0x00)
        fun alignCenter(): ByteArray = byteArrayOf(0x1B, 0x61, 0x01)
        fun alignRight(): ByteArray = byteArrayOf(0x1B, 0x61, 0x02)
        fun doubleWidthOn(): ByteArray = byteArrayOf(0x1B, 0x21, 0x20)
        fun doubleWidthOff(): ByteArray = byteArrayOf(0x1B, 0x21, 0x00)
        fun barcodeHeight(height: Int = 162): ByteArray = GS + byteArrayOf(0x68, height.toByte())
        fun hriPosition(pos: Int = 2): ByteArray = GS + byteArrayOf(0x48, pos.toByte())
        fun barcodeWidth(width: Int = 3): ByteArray = GS + byteArrayOf(0x77, width.toByte())
        fun barcodeEAN13(data: String): ByteArray {
            val d = data.take(13).padEnd(13, '0')
            return GS + byteArrayOf(0x6B, 0x43, d.length.toByte()) + d.toByteArray()
        }
        fun barcodeCODE128(data: String): ByteArray {
            val d = data.take(48).toByteArray()
            return GS + byteArrayOf(0x6B, 0x49, d.size.toByte()) + d
        }
        fun qrCode(data: String): ByteArray {
            val d = data.toByteArray()
            val pL = (d.size % 256).toByte()
            val pH = (d.size / 256).toByte()
            return GS + byteArrayOf(0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00) +
                GS + byteArrayOf(0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08) +
                GS + byteArrayOf(0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30) +
                GS + byteArrayOf(0x28, 0x6B, (pL + 3).toByte(), pH, 0x31, 0x50, 0x30) +
                GS + byteArrayOf(0x28, 0x6B, pL, pH, 0x31, 0x49, 0x4D) + d +
                GS + byteArrayOf(0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
        }
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    fun discoverDevices(): Flow<List<BluetoothDeviceInfo>> = flow {
        val devices = mutableListOf<BluetoothDeviceInfo>()

        bluetoothAdapter?.let { adapter ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                val bonded = adapter.bondedDevices
                bonded?.forEach { device ->
                    devices.add(
                        BluetoothDeviceInfo(
                            name = device.name ?: "Unknown",
                            address = device.address,
                            type = "BT"
                        )
                    )
                }
            }
        }

        val usbDeviceList = usbManager.deviceList
        usbDeviceList.values.forEach { usbDevice ->
            val isPrinterOrScanner = (0 until usbDevice.interfaceCount).any { i ->
                val intf = usbDevice.getInterface(i)
                intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER ||
                    intf.interfaceClass == 0x03 ||
                    intf.interfaceProtocol == 0x01
            }
            if (isPrinterOrScanner) {
                devices.add(
                    BluetoothDeviceInfo(
                        name = usbDevice.productName ?: usbDevice.deviceName ?: "USB Device",
                        address = usbDevice.deviceName,
                        type = "USB"
                    )
                )
            }
        }

        emit(devices.toList())
    }.flowOn(Dispatchers.IO)

    private suspend fun requestUsbPermission(usbDevice: UsbDevice): Boolean = suspendCancellableCoroutine { cont ->
        if (usbManager.hasPermission(usbDevice)) {
            cont.resume(true)
            return@suspendCancellableCoroutine
        }
        val permissionGranted = AtomicBoolean(false)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == "com.arynoxtech.erp.USB_PERMISSION") {
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    permissionGranted.set(granted)
                    context.unregisterReceiver(this)
                    cont.resume(granted)
                }
            }
        }
        context.registerReceiver(receiver, IntentFilter("com.arynoxtech.erp.USB_PERMISSION"))
        val pi = android.app.PendingIntent.getBroadcast(
            context, 0, Intent("com.arynoxtech.erp.USB_PERMISSION"),
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )
        usbManager.requestPermission(usbDevice, pi)
        if (cont.isCancelled) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
        }
    }

    @SuppressLint("MissingPermission")
    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    suspend fun connectToDevice(deviceInfo: BluetoothDeviceInfo): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            when (deviceInfo.type) {
                "BT" -> {
                    val device = bluetoothAdapter?.getRemoteDevice(deviceInfo.address)
                        ?: return@withContext false
                    val uuid = UUID.fromString(SPP_UUID)
                    val socket = device.createRfcommSocketToServiceRecord(uuid)
                    bluetoothAdapter?.cancelDiscovery()
                    socket.connect()
                    bluetoothSocket = socket
                    connectedDevice = deviceInfo
                    connectedDevices.add(deviceInfo)
                    true
                }
                "USB" -> {
                    val usbDevice = usbManager.deviceList.values.find {
                        it.deviceName == deviceInfo.address
                    } ?: return@withContext false

                    if (!requestUsbPermission(usbDevice)) {
                        return@withContext false
                    }

                    val connection = usbManager.openDevice(usbDevice)
                    if (connection == null) {
                        return@withContext false
                    }

                    val interface_ = (0 until usbDevice.interfaceCount).map { usbDevice.getInterface(it) }
                        .firstOrNull { intf ->
                            intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER ||
                                intf.interfaceClass == 0x03 ||
                                intf.interfaceProtocol == 0x01
                        } ?: usbDevice.getInterface(0)

                    val endpointOut = (0 until interface_.endpointCount).map { interface_.getEndpoint(it) }
                        .firstOrNull { ep ->
                            ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                                ep.direction == android.hardware.usb.UsbConstants.USB_DIR_OUT
                        }

                    val endpointIn = (0 until interface_.endpointCount).map { interface_.getEndpoint(it) }
                        .firstOrNull { ep ->
                            ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                                ep.direction == android.hardware.usb.UsbConstants.USB_DIR_IN
                        }

                    if (connection.claimInterface(interface_, true)) {
                        val outStream = object : java.io.OutputStream() {
                            override fun write(b: Int) {
                                val buffer = byteArrayOf(b.toByte())
                                connection.bulkTransfer(endpointOut as android.hardware.usb.UsbEndpoint, buffer, buffer.size, USB_TIMEOUT_MS)
                            }
                            override fun write(b: ByteArray, off: Int, len: Int) {
                                val data = if (off == 0 && len == b.size) b else b.copyOfRange(off, off + len)
                                connection.bulkTransfer(endpointOut as android.hardware.usb.UsbEndpoint, data, data.size, USB_TIMEOUT_MS)
                            }
                        }
                        usbDeviceConnection = connection
                        usbOutputStream = outStream

                        if (endpointIn != null) {
                            val inStream = object : java.io.InputStream() {
                                override fun read(): Int {
                                    val buffer = ByteArray(1)
                                    val result = connection.bulkTransfer(endpointIn as android.hardware.usb.UsbEndpoint, buffer, 1, USB_TIMEOUT_MS)
                                    return if (result >= 0) buffer[0].toInt() and 0xFF else -1
                                }
                                override fun read(b: ByteArray, off: Int, len: Int): Int {
                                    return connection.bulkTransfer(endpointIn as android.hardware.usb.UsbEndpoint, b, len, USB_TIMEOUT_MS)
                            }
                            }
                            usbInputStream = inStream
                        }

                        connectedDevice = deviceInfo
                        connectedDevices.add(deviceInfo)
                        true
                    } else {
                        connection.close()
                        false
                    }
                }
                else -> false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    suspend fun printText(text: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val data = buildList {
                add(alignLeft())
                add(text.toByteArray(Charsets.UTF_8))
                add("\n".toByteArray())
            }.reduce { a, b -> a + b }

            writeToDevice(data)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun printThermal(text: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val data = buildList {
                add(initPrinter())
                add(alignCenter())
                add(doubleWidthOn())
                add(text.toByteArray(Charsets.UTF_8))
                add(doubleWidthOff())
                add("\n\n".toByteArray())
                add(feedPaper(2))
                add(cutPaper())
            }.reduce { a, b -> a + b }

            writeToDevice(data)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun printBarcode(data: String, format: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val cmd = when (format.uppercase()) {
                "EAN13" -> barcodeEAN13(data)
                "CODE128", "CODE_128" -> barcodeCODE128(data)
                "QR", "QRCODE" -> qrCode(data)
                else -> barcodeCODE128(data)
            }
            val payload = buildList {
                add(initPrinter())
                add(barcodeHeight(162))
                add(barcodeWidth(3))
                add(hriPosition(2))
                add(alignCenter())
                add(cmd)
                add("\n".toByteArray())
                add(alignCenter())
                add(data.toByteArray(Charsets.UTF_8))
                add("\n\n".toByteArray())
                add(feedPaper(3))
                add(cutPaper())
            }.reduce { a, b -> a + b }

            writeToDevice(payload)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun printReceipt(
        items: List<ReceiptLine>,
        total: Double,
        gst: Double
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = mutableListOf<ByteArray>()
            payload.add(initPrinter())
            payload.add(alignCenter())
            payload.add(doubleWidthOn())
            payload.add("ADITYA ENTERPRISES\n".toByteArray(Charsets.UTF_8))
            payload.add(doubleWidthOff())
            payload.add("GST: 27ABCDE1234F1Z5\n".toByteArray(Charsets.UTF_8))
            payload.add("----------------------------\n".toByteArray(Charsets.UTF_8))
            payload.add(alignLeft())

            items.forEach { line ->
                when {
                    line.align == 1 -> payload.add(alignCenter())
                    line.align == 2 -> payload.add(alignRight())
                    else -> payload.add(alignLeft())
                }
                if (line.isBold) payload.add(boldOn())
                if (line.isDoubleWidth) payload.add(doubleWidthOn())
                payload.add((line.text + "\n").toByteArray(Charsets.UTF_8))
                if (line.isDoubleWidth) payload.add(doubleWidthOff())
                if (line.isBold) payload.add(boldOff())
            }

            payload.add("----------------------------\n".toByteArray(Charsets.UTF_8))
            payload.add(boldOn())
            payload.add(alignRight())
            payload.add("Total: %.2f\n".format(total).toByteArray(Charsets.UTF_8))
            payload.add("GST: %.2f\n".format(gst).toByteArray(Charsets.UTF_8))
            payload.add(boldOff())
            payload.add("\n".toByteArray(Charsets.UTF_8))
            payload.add(alignCenter())
            payload.add("*** Thank You ***\n".toByteArray(Charsets.UTF_8))
            payload.add(feedPaper(3))
            payload.add(cutPaper())

            val data = payload.reduce { a, b -> a + b }
            writeToDevice(data)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    fun scanBarcode(): Flow<String> = flow {
        while (true) {
            try {
                val inputStream = getInputStream()
                if (inputStream != null) {
                    if (inputStream.available() > 0) {
                        val buffer = ByteArray(1024)
                        val bytesRead = inputStream.read(buffer)
                        if (bytesRead > 0) {
                            val raw = String(buffer, 0, bytesRead, Charsets.UTF_8).trim()
                            if (raw.isNotBlank()) {
                                emit(raw)
                            }
                        }
                    }
                }
                delay(100)
            } catch (e: Exception) {
                e.printStackTrace()
                delay(1000)
            }
        }
    }.flowOn(Dispatchers.IO)

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            bluetoothSocket?.close()
        } catch (_: Exception) {}
        bluetoothSocket = null

        try {
            usbOutputStream?.close()
        } catch (_: Exception) {}
        usbOutputStream = null

        try {
            usbInputStream?.close()
        } catch (_: Exception) {}
        usbInputStream = null

        try {
            usbDeviceConnection?.close()
        } catch (_: Exception) {}
        usbDeviceConnection = null

        connectedDevice?.let { connectedDevices.remove(it) }
        connectedDevice = null
    }

    fun isConnected(): Boolean = bluetoothSocket?.isConnected == true ||
        usbDeviceConnection != null

    fun getConnectedDevices(): List<BluetoothDeviceInfo> = connectedDevices.toList()

    @Throws
    private fun writeToDevice(data: ByteArray) {
        val socket = bluetoothSocket
        if (socket != null && socket.isConnected) {
            val out = socket.outputStream
            out.write(data)
            out.flush()
            return
        }

        val usbOut = usbOutputStream
        if (usbOut != null) {
            usbOut.write(data)
            usbOut.flush()
            return
        }

        throw IllegalStateException("No device connected")
    }

    private fun getInputStream(): InputStream? {
        usbInputStream?.let { return it }
        val socket = bluetoothSocket
        if (socket != null && socket.isConnected) {
            return socket.inputStream
        }
        return null
    }
}
