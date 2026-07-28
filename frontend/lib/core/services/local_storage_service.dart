import 'package:hive_flutter/hive_flutter.dart';
import 'logger.dart';

class LocalStorageService {
  static late Box _settingsBox;
  static late Box _cacheBox;
  static late Box _userBox;

  static Future<void> initialize() async {
    _settingsBox = await Hive.openBox('settings');
    _cacheBox = await Hive.openBox('cache');
    _userBox = await Hive.openBox('user');
    AppLogger.info('LocalStorage initialized');
  }

  // Settings
  static Future<void> setSetting(String key, dynamic value) async {
    await _settingsBox.put(key, value);
  }

  static T? getSetting<T>(String key, {T? defaultValue}) {
    return _settingsBox.get(key, defaultValue: defaultValue) as T?;
  }

  static Future<void> removeSetting(String key) async {
    await _settingsBox.delete(key);
  }

  // Cache
  static Future<void> setCache(String key, dynamic value) async {
    await _cacheBox.put(key, value);
  }

  static T? getCache<T>(String key) {
    return _cacheBox.get(key) as T?;
  }

  static Future<void> clearCache() async {
    await _cacheBox.clear();
  }

  // User Preferences
  static Future<void> setUserPref(String key, dynamic value) async {
    await _userBox.put(key, value);
  }

  static T? getUserPref<T>(String key, {T? defaultValue}) {
    return _userBox.get(key, defaultValue: defaultValue) as T?;
  }
}
