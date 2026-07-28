import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:hive/hive.dart';
import '../constants/app_constants.dart';
import '../utils/logger.dart';

class GroqModel {
  final String id;
  final String object;
  final int created;
  final String ownedBy;
  final bool active;
  final String? contextWindow;
  final String? maxTokens;

  GroqModel({
    required this.id,
    required this.object,
    required this.created,
    required this.ownedBy,
    required this.active,
    this.contextWindow,
    this.maxTokens,
  });

  factory GroqModel.fromJson(Map<String, dynamic> json) {
    return GroqModel(
      id: json['id'] ?? '',
      object: json['object'] ?? '',
      created: json['created'] ?? 0,
      ownedBy: json['owned_by'] ?? '',
      active: json['active'] ?? true,
      contextWindow: json['context_window']?.toString(),
      maxTokens: json['max_completion_tokens']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'object': object,
    'created': created,
    'owned_by': ownedBy,
    'active': active,
    'context_window': contextWindow,
    'max_completion_tokens': maxTokens,
  };
}

class GroqAIResponse {
  final String content;
  final String model;
  final int promptTokens;
  final int completionTokens;
  final int totalTokens;
  final bool success;
  final String? error;

  GroqAIResponse({
    required this.content,
    required this.model,
    required this.promptTokens,
    required this.completionTokens,
    required this.totalTokens,
    this.success = true,
    this.error,
  });

  factory GroqAIResponse.error(String error) {
    return GroqAIResponse(
      content: '',
      model: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      success: false,
      error: error,
    );
  }
}

class GroqAIService {
  static final GroqAIService _instance = GroqAIService._internal();
  factory GroqAIService() => _instance;
  GroqAIService._internal();

  late Box _settingsBox;
  List<GroqModel> _availableModels = [];
  String? _apiKey;

  // AI Agent System Prompts
  static const String businessAnalystPrompt = """You are ArynoxTech ERP Business Analyst AI. 
You analyze business data for Sainath Enterprises and provide insights on:
- Revenue Analysis
- Profit & Loss Analysis
- Inventory Analysis
- Demand Forecasting
- Customer Behavior
- Supplier Performance
- Dead Stock Detection
- Fast Moving Products
- Seasonal Forecasting
- Reorder Predictions
- Profit Margin Suggestions
- Discount Suggestions
- Business Health Score

Provide actionable, data-driven recommendations. Be concise but thorough.""";

  static const String inventoryAIPrompt = """You are ArynoxTech Inventory AI.
You monitor and analyze inventory data. You can:
- Identify low stock items
- Suggest reorder quantities
- Detect dead stock
- Analyze stock movement patterns
- Predict inventory requirements
- Suggest optimal stock levels
- Identify fast/slow moving items

Always provide specific SKU references and actionable recommendations.""";

  static const String salesAIPrompt = """You are ArynoxTech Sales AI.
You analyze sales data and provide insights on:
- Sales trends
- Customer buying patterns
- Product performance
- Revenue forecasting
- Seasonal sales patterns
- Discount effectiveness
- Sales team performance

Focus on actionable sales strategies.""";

  static const String purchaseAIPrompt = """You are ArynoxTech Purchase AI.
You optimize procurement decisions by analyzing:
- Supplier performance
- Purchase trends
- Cost optimization
- Order timing
- Quantity optimization
- Payment terms analysis
- Vendor comparison

Provide specific supplier recommendations and cost-saving strategies.""";

  static const String accountingAIPrompt = """You are ArynoxTech Accounting AI.
You analyze financial data and provide:
- Cash flow analysis
- Expense categorization
- Profit margin analysis
- Tax optimization suggestions
- GST compliance checks
- Financial health indicators
- Budget variance analysis

Ensure all recommendations comply with Indian accounting standards.""";

  static const String forecastingAIPrompt = """You are ArynoxTech Forecasting AI.
You predict future business metrics using historical data:
- Sales forecasting
- Inventory demand prediction
- Revenue projections
- Expense forecasting
- Seasonal trend analysis
- Growth rate predictions
- Market trend analysis

Always provide confidence intervals and explain your methodology.""";

  static const String aiAgentPrompt = """You are ArynoxTech Autonomous AI Agent.
You continuously monitor the ERP system and proactively:
- Alert on low inventory
- Notify about sales anomalies
- Flag unusual expenses
- Recommend actions
- Generate daily/weekly summaries
- Detect potential problems
- Suggest optimizations

Be proactive and concise. Alert only when necessary.""";

  Future<void> initialize() async {
    _settingsBox = await Hive.openBox('ai_settings');
    _apiKey = _settingsBox.get('groq_api_key');
    await fetchAvailableModels();
  }

  String? get apiKey => _apiKey;

  Future<void> setApiKey(String key) async {
    _apiKey = key;
    await _settingsBox.put('groq_api_key', key);
    await fetchAvailableModels();
  }

  List<GroqModel> get availableModels => _availableModels;

  String get preferredModel {
    return _settingsBox.get('preferred_model', defaultValue: 'llama-3.3-70b-versatile');
  }

  Future<void> setPreferredModel(String modelId) async {
    await _settingsBox.put('preferred_model', modelId);
  }

  Future<List<GroqModel>> fetchAvailableModels() async {
    try {
      if (_apiKey == null || _apiKey!.isEmpty) {
        AppLogger.warning('Groq API key not set');
        return [];
      }

      final response = await http.get(
        Uri.parse('${AppConstants.groqBaseUrl}/models'),
        headers: {
          'Authorization': 'Bearer ' + _apiKey!,
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final modelsList = data['data'] as List<dynamic>;

        _availableModels = modelsList
            .map((m) => GroqModel.fromJson(m))
            .where((m) => m.active)
            .toList();

        await _settingsBox.put('cached_models', 
          jsonEncode(_availableModels.map((m) => m.toJson()).toList()));

        AppLogger.info('Fetched ${_availableModels.length} Groq models');
        return _availableModels;
      } else {
        AppLogger.error('Failed to fetch models: ${response.statusCode}');
        return _loadCachedModels();
      }
    } catch (e) {
      AppLogger.error('Error fetching Groq models: $e');
      return _loadCachedModels();
    }
  }

  List<GroqModel> _loadCachedModels() {
    try {
      final cached = _settingsBox.get('cached_models');
      if (cached != null) {
        final List<dynamic> data = jsonDecode(cached);
        _availableModels = data.map((m) => GroqModel.fromJson(m)).toList();
        return _availableModels;
      }
    } catch (e) {
      AppLogger.error('Error loading cached models: $e');
    }
    return [];
  }

  Future<GroqAIResponse> chatCompletion({
    required String prompt,
    String? systemPrompt,
    String? model,
    double temperature = 0.7,
    int maxTokens = 4096,
    List<Map<String, String>>? conversationHistory,
  }) async {
    try {
      if (_apiKey == null || _apiKey!.isEmpty) {
        return GroqAIResponse.error('Groq API key not configured');
      }

      final selectedModel = model ?? preferredModel;

      if (_availableModels.isNotEmpty && 
          !_availableModels.any((m) => m.id == selectedModel)) {
        final fallbackModel = _availableModels.first.id;
        AppLogger.warning('Model $selectedModel unavailable, using $fallbackModel');
      }

      final messages = <Map<String, String>>[];

      if (systemPrompt != null) {
        messages.add({'role': 'system', 'content': systemPrompt});
      }

      if (conversationHistory != null) {
        messages.addAll(conversationHistory);
      }

      messages.add({'role': 'user', 'content': prompt});

      final response = await http.post(
        Uri.parse('${AppConstants.groqBaseUrl}/chat/completions'),
        headers: {
          'Authorization': 'Bearer ' + _apiKey!,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'model': selectedModel,
          'messages': messages,
          'temperature': temperature,
          'max_tokens': maxTokens,
          'stream': false,
        }),
      ).timeout(const Duration(seconds: 60));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final choice = data['choices'][0];
        final message = choice['message'];
        final usage = data['usage'];

        return GroqAIResponse(
          content: message['content'] ?? '',
          model: data['model'] ?? selectedModel,
          promptTokens: usage['prompt_tokens'] ?? 0,
          completionTokens: usage['completion_tokens'] ?? 0,
          totalTokens: usage['total_tokens'] ?? 0,
        );
      } else if (response.statusCode == 429) {
        return GroqAIResponse.error('Rate limit exceeded. Please try again later.');
      } else {
        return GroqAIResponse.error('API Error: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      AppLogger.error('Groq API error: $e');
      return GroqAIResponse.error('Network error: $e');
    }
  }

  Future<GroqAIResponse> businessAnalysis(String query, {Map<String, dynamic>? businessData}) async {
    String enrichedPrompt = query;
    if (businessData != null) {
      enrichedPrompt = """
Business Context Data:
${jsonEncode(businessData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: businessAnalystPrompt,
      temperature: 0.5,
    );
  }

  Future<GroqAIResponse> inventoryAnalysis(String query, {Map<String, dynamic>? inventoryData}) async {
    String enrichedPrompt = query;
    if (inventoryData != null) {
      enrichedPrompt = """
Inventory Data:
${jsonEncode(inventoryData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: inventoryAIPrompt,
      temperature: 0.3,
    );
  }

  Future<GroqAIResponse> salesAnalysis(String query, {Map<String, dynamic>? salesData}) async {
    String enrichedPrompt = query;
    if (salesData != null) {
      enrichedPrompt = """
Sales Data:
${jsonEncode(salesData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: salesAIPrompt,
      temperature: 0.5,
    );
  }

  Future<GroqAIResponse> purchaseAnalysis(String query, {Map<String, dynamic>? purchaseData}) async {
    String enrichedPrompt = query;
    if (purchaseData != null) {
      enrichedPrompt = """
Purchase Data:
${jsonEncode(purchaseData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: purchaseAIPrompt,
      temperature: 0.4,
    );
  }

  Future<GroqAIResponse> accountingAnalysis(String query, {Map<String, dynamic>? financialData}) async {
    String enrichedPrompt = query;
    if (financialData != null) {
      enrichedPrompt = """
Financial Data:
${jsonEncode(financialData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: accountingAIPrompt,
      temperature: 0.3,
    );
  }

  Future<GroqAIResponse> forecasting(String query, {Map<String, dynamic>? historicalData}) async {
    String enrichedPrompt = query;
    if (historicalData != null) {
      enrichedPrompt = """
Historical Data:
${jsonEncode(historicalData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: forecastingAIPrompt,
      temperature: 0.2,
      maxTokens: 8192,
    );
  }

  Future<GroqAIResponse> aiAgentQuery(String query, {Map<String, dynamic>? systemData}) async {
    String enrichedPrompt = query;
    if (systemData != null) {
      enrichedPrompt = """
System Status:
${jsonEncode(systemData)}

User Query: $query
""";
    }

    return chatCompletion(
      prompt: enrichedPrompt,
      systemPrompt: aiAgentPrompt,
      temperature: 0.4,
    );
  }

  Future<GroqAIResponse> generateReport({
    required String reportType,
    required Map<String, dynamic> data,
    String? customInstructions,
  }) async {
    final prompt = """
Generate a comprehensive $reportType report for Sainath Enterprises.

Data:
${jsonEncode(data)}

${customInstructions != null ? 'Additional Instructions: $customInstructions' : ''}

Format the report with:
1. Executive Summary
2. Key Metrics
3. Trends Analysis
4. Recommendations
5. Action Items
""";

    return chatCompletion(
      prompt: prompt,
      systemPrompt: businessAnalystPrompt,
      temperature: 0.4,
      maxTokens: 8192,
    );
  }
}
