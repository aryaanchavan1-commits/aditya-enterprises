import 'package:equatable/equatable.dart';

class Product extends Equatable {
  final String id;
  final String name;
  final String sku;
  final String? hsnCode;
  final String? barcode;
  final String? qrCode;
  final String? description;
  final String category;
  final String? subCategory;
  final String? brand;
  final String unit;
  final double purchasePrice;
  final double sellingPrice;
  final double? discount;
  final double? tax;
  final double? gst;
  final int minimumStock;
  final int maximumStock;
  final int openingStock;
  final int currentStock;
  final String? warehouse;
  final String? supplier;
  final String? location;
  final DateTime? expiryDate;
  final DateTime? manufacturingDate;
  final String? batchNumber;
  final String? serialNumber;
  final String? notes;
  final List<String> images;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isActive;

  const Product({
    required this.id,
    required this.name,
    required this.sku,
    this.hsnCode,
    this.barcode,
    this.qrCode,
    this.description,
    required this.category,
    this.subCategory,
    this.brand,
    required this.unit,
    required this.purchasePrice,
    required this.sellingPrice,
    this.discount,
    this.tax,
    this.gst,
    required this.minimumStock,
    required this.maximumStock,
    required this.openingStock,
    required this.currentStock,
    this.warehouse,
    this.supplier,
    this.location,
    this.expiryDate,
    this.manufacturingDate,
    this.batchNumber,
    this.serialNumber,
    this.notes,
    this.images = const [],
    required this.createdAt,
    required this.updatedAt,
    this.isActive = true,
  });

  double get profitMargin => 
      purchasePrice > 0 ? ((sellingPrice - purchasePrice) / purchasePrice) * 100 : 0;

  double get inventoryValue => currentStock * purchasePrice;

  double get potentialRevenue => currentStock * sellingPrice;

  bool get isLowStock => currentStock <= minimumStock;

  bool get isOverStock => currentStock >= maximumStock;

  Product copyWith({
    String? id,
    String? name,
    String? sku,
    String? hsnCode,
    String? barcode,
    String? qrCode,
    String? description,
    String? category,
    String? subCategory,
    String? brand,
    String? unit,
    double? purchasePrice,
    double? sellingPrice,
    double? discount,
    double? tax,
    double? gst,
    int? minimumStock,
    int? maximumStock,
    int? openingStock,
    int? currentStock,
    String? warehouse,
    String? supplier,
    String? location,
    DateTime? expiryDate,
    DateTime? manufacturingDate,
    String? batchNumber,
    String? serialNumber,
    String? notes,
    List<String>? images,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isActive,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      sku: sku ?? this.sku,
      hsnCode: hsnCode ?? this.hsnCode,
      barcode: barcode ?? this.barcode,
      qrCode: qrCode ?? this.qrCode,
      description: description ?? this.description,
      category: category ?? this.category,
      subCategory: subCategory ?? this.subCategory,
      brand: brand ?? this.brand,
      unit: unit ?? this.unit,
      purchasePrice: purchasePrice ?? this.purchasePrice,
      sellingPrice: sellingPrice ?? this.sellingPrice,
      discount: discount ?? this.discount,
      tax: tax ?? this.tax,
      gst: gst ?? this.gst,
      minimumStock: minimumStock ?? this.minimumStock,
      maximumStock: maximumStock ?? this.maximumStock,
      openingStock: openingStock ?? this.openingStock,
      currentStock: currentStock ?? this.currentStock,
      warehouse: warehouse ?? this.warehouse,
      supplier: supplier ?? this.supplier,
      location: location ?? this.location,
      expiryDate: expiryDate ?? this.expiryDate,
      manufacturingDate: manufacturingDate ?? this.manufacturingDate,
      batchNumber: batchNumber ?? this.batchNumber,
      serialNumber: serialNumber ?? this.serialNumber,
      notes: notes ?? this.notes,
      images: images ?? this.images,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  List<Object?> get props => [id, sku, name];
}
