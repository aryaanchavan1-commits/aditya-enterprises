package com.arynoxtech.erp.service

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

data class AiModelInfo(
    val id: String,
    val name: String,
    val contextWindow: Int
)

@Singleton
class GroqAiService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var tts: TextToSpeech? = null
    private var ttsInitialized = false
    private var apiKey: String = ""
    private val baseUrl = "https://api.groq.com/openai/v1"

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    fun setApiKey(key: String) {
        apiKey = key
    }

    fun chat(
        message: String,
        model: String = "llama-3.3-70b-versatile"
    ): Flow<String> = callbackFlow {
        val json = JSONObject().apply {
            put("model", model)
            put("messages", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("content", message)
                })
            })
            put("stream", true)
            put("temperature", 0.7)
            put("max_tokens", 2048)
        }

        val request = Request.Builder()
            .url("$baseUrl/chat/completions")
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(json.toString().toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                close(e)
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.byteStream()
                    if (body == null) {
                        close(Exception("Empty response body"))
                        return
                    }
                    val reader = BufferedReader(InputStreamReader(body))
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val currentLine = line ?: continue
                        if (currentLine.startsWith("data: ")) {
                            val data = currentLine.removePrefix("data: ").trim()
                            if (data == "[DONE]") break
                            try {
                                val jsonObj = JSONObject(data)
                                val choices = jsonObj.optJSONArray("choices")
                                if (choices != null && choices.length() > 0) {
                                    val delta = choices.getJSONObject(0)
                                        .optJSONObject("delta")
                                    val content = delta?.optString("content", "")
                                    if (!content.isNullOrBlank()) {
                                        trySend(content)
                                    }
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    close()
                } catch (e: Exception) {
                    close(e)
                }
            }
        })

        awaitClose()
    }.flowOn(Dispatchers.IO)

    suspend fun analyzeBusiness(query: String, businessContext: String): String =
        performAnalysis("business_analysis", query, businessContext)

    suspend fun analyzeInventory(query: String, inventoryData: String): String =
        performAnalysis("inventory_analysis", query, inventoryData)

    suspend fun analyzeSales(query: String, salesData: String): String =
        performAnalysis("sales_analysis", query, salesData)

    suspend fun analyzeAccounting(query: String, financialData: String): String =
        performAnalysis("accounting_analysis", query, financialData)

    suspend fun forecast(query: String, historicalData: String): String =
        performAnalysis("forecast", query, historicalData)

    suspend fun agentQuery(query: String, systemData: String): String =
        performAnalysis("agent", query, systemData)

    fun streamingChat(message: String, model: String, systemPrompt: String? = null): Flow<String> = callbackFlow {
        val messages = JSONArray()
        systemPrompt?.let {
            messages.put(JSONObject().apply {
                put("role", "system")
                put("content", it)
            })
        }
        messages.put(JSONObject().apply {
            put("role", "user")
            put("content", message)
        })

        val json = JSONObject().apply {
            put("model", model)
            put("messages", messages)
            put("stream", true)
            put("temperature", 0.7)
            put("max_tokens", 4096)
        }

        val request = Request.Builder()
            .url("$baseUrl/chat/completions")
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(json.toString().toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                close(e)
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.byteStream()
                    if (body == null) { close(Exception("Empty response body")); return }
                    val reader = BufferedReader(InputStreamReader(body))
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val currentLine = line ?: continue
                        if (currentLine.startsWith("data: ")) {
                            val data = currentLine.removePrefix("data: ").trim()
                            if (data == "[DONE]") break
                            try {
                                val jsonObj = JSONObject(data)
                                val choices = jsonObj.optJSONArray("choices")
                                if (choices != null && choices.length() > 0) {
                                    val delta = choices.getJSONObject(0).optJSONObject("delta")
                                    val content = delta?.optString("content", "")
                                    if (!content.isNullOrBlank()) trySend(content)
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    close()
                } catch (e: Exception) { close(e) }
            }
        })
        awaitClose()
    }.flowOn(Dispatchers.IO)

    private suspend fun performAnalysis(type: String, query: String, contextData: String): String =
        withContext(Dispatchers.IO) {
            try {
                val systemPrompt = buildString {
                    append("You are an expert ERP assistant for Aditya Enterprises. ")
                    when (type) {
                        "business_analysis" -> {
                            append("Analyze the following business context and answer the query. ")
                            append("Provide actionable insights and recommendations.")
                        }
                        "inventory_analysis" -> {
                            append("Analyze the inventory data provided. ")
                            append("Identify trends, slow-moving items, stockout risks, and suggest reorder strategies.")
                        }
                        "sales_analysis" -> {
                            append("Analyze the sales data provided. ")
                            append("Identify patterns, top products, seasonal trends, and growth opportunities.")
                        }
                        "accounting_analysis" -> {
                            append("Analyze the financial data provided. ")
                            append("Evaluate profitability, cash flow, and suggest cost optimization.")
                        }
                        "forecast" -> {
                            append("Based on historical data, forecast future trends. ")
                            append("Provide numerical projections where possible.")
                        }
                        "agent" -> {
                            append("You are an intelligent agent that can answer queries about the ERP system. ")
                            append("Use the provided system data to give accurate, concise answers.")
                        }
                    }
                }

                val json = JSONObject().apply {
                    put("model", "llama-3.3-70b-versatile")
                    put("messages", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "system")
                            put("content", systemPrompt)
                        })
                        put(JSONObject().apply {
                            put("role", "user")
                            put("content", "Context data:\n$contextData\n\nQuery: $query")
                        })
                    })
                    put("temperature", 0.3)
                    put("max_tokens", 4096)
                }

                val request = Request.Builder()
                    .url("$baseUrl/chat/completions")
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .post(json.toString().toRequestBody(jsonMediaType))
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext "Error: Empty response"

                val jsonResp = JSONObject(body)
                val choices = jsonResp.optJSONArray("choices")
                if (choices != null && choices.length() > 0) {
                    choices.getJSONObject(0)
                        .optJSONObject("message")
                        ?.optString("content", "No response") ?: "No response"
                } else {
                    "Error: Unexpected response format"
                }
            } catch (e: Exception) {
                "Error: ${e.message ?: "Unknown error"}"
            }
        }

    fun getAvailableModels(): List<AiModelInfo> = listOf(
        AiModelInfo("llama-3.3-70b-versatile", "Llama 3.3 70B (Versatile)", 32768),
        AiModelInfo("llama-3.1-8b-instant", "Llama 3.1 8B (Instant)", 131072),
        AiModelInfo("mixtral-8x7b-32768", "Mixtral 8x7B", 32768),
        AiModelInfo("gemma2-9b-it", "Gemma 2 9B", 8192),
        AiModelInfo("llama-3.2-90b-vision-preview", "Llama 3.2 90B Vision", 131072)
    )

    fun speak(text: String) {
        if (!ttsInitialized) {
            initTts()
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "groq_utterance")
    }

    private fun initTts() {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.ENGLISH
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}
                    override fun onDone(utteranceId: String?) {}
                    override fun onError(utteranceId: String?) {}
                })
                ttsInitialized = true
            }
        }
    }

    fun stopSpeaking() {
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsInitialized = false
    }
}
