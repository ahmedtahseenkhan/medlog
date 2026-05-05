module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for WatermelonDB model decorators (@field, @date, @readonly)
      // Must come before any class-properties transform
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  }
}
